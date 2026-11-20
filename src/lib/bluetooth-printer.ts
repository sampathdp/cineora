/**
 * Prints ticket slips on a Bluetooth (BLE) ESC/POS thermal printer through Web Bluetooth.
 *
 * Works in Chrome / Edge on desktop and Android over https://. Not available on iOS Safari or Firefox.
 * Classic-Bluetooth-only printers (no BLE) cannot be reached from a browser; pair those with the OS and use the
 * normal print dialog instead.
 */

// Minimal Web Bluetooth typings (not part of TypeScript's DOM lib).
type BleCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(data: BufferSource): Promise<void>;
  writeValueWithoutResponse(data: BufferSource): Promise<void>;
};
type BleService = { getCharacteristics(): Promise<BleCharacteristic[]> };
type BleServer = { connected: boolean; getPrimaryServices(): Promise<BleService[]> };
type BleDevice = {
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<BleServer>; disconnect(): void };
  addEventListener(type: "gattserverdisconnected", fn: () => void): void;
};
type BluetoothApi = { requestDevice(options: { acceptAllDevices: boolean; optionalServices: (string | number)[] }): Promise<BleDevice> };

// Services used by common 58/80 mm thermal printers (generic Chinese modules, Xprinter, Goojprt, MUNBYN, Epson BLE…).
const PRINTER_SERVICES: (string | number)[] = [
  0x18f0,
  0xff00,
  0xffe0,
  0xfee7,
  0xae30,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
];

export type TicketSlip = {
  title: string;
  movie: string;
  hall: string;
  seat: string;
  category?: string;
  showtime: string;
  reference: string;
  /** Printed as a QR code (ESC/POS native). */
  qr?: string;
  footer?: string;
};

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator && typeof window !== "undefined" && window.isSecureContext;
}

export class BluetoothPrinter {
  private device: BleDevice | null = null;
  private characteristic: BleCharacteristic | null = null;

  get name(): string | null {
    return this.device?.name ?? (this.device ? "Bluetooth printer" : null);
  }

  get connected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic;
  }

  /** Opens the browser's device picker (must run from a click) and finds a writable characteristic. */
  async connect(onDisconnect?: () => void): Promise<string> {
    if (!bluetoothSupported()) throw new Error("Bluetooth printing needs Chrome or Edge over https:// (not iOS).");
    const bluetooth = (navigator as unknown as { bluetooth: BluetoothApi }).bluetooth;
    const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    device.addEventListener("gattserverdisconnected", () => {
      this.characteristic = null;
      onDisconnect?.();
    });
    this.device = device;
    await this.attach();
    return this.name!;
  }

  disconnect() {
    this.device?.gatt?.disconnect();
    this.device = null;
    this.characteristic = null;
  }

  private async attach() {
    const server = await this.device!.gatt!.connect();
    for (const service of await server.getPrimaryServices()) {
      for (const c of await service.getCharacteristics()) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          this.characteristic = c;
          return;
        }
      }
    }
    this.disconnect();
    throw new Error("This device has no writable printer channel. Is it an ESC/POS BLE printer?");
  }

  async printTicket(slip: TicketSlip) {
    await this.write(ticketBytes(slip));
  }

  private async write(bytes: Uint8Array) {
    if (!this.device) throw new Error("No printer connected.");
    if (!this.connected) await this.attach(); // reconnect after the printer slept
    const c = this.characteristic!;
    // BLE packets are small; send in chunks and give cheap printers time to drain their buffer.
    const size = 180;
    for (let i = 0; i < bytes.length; i += size) {
      const chunk = bytes.slice(i, i + size);
      if (c.properties.writeWithoutResponse) {
        await c.writeValueWithoutResponse(chunk);
        await new Promise((r) => setTimeout(r, 20));
      } else {
        await c.writeValueWithResponse(chunk);
      }
    }
  }
}

// --- ESC/POS encoding ---------------------------------------------------------------------------------------------

const ESC = 0x1b;
const GS = 0x1d;

function text(s: string): number[] {
  // Thermal printers use a single-byte code page: keep ASCII, replace anything else.
  const ascii = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return Array.from(ascii, (ch) => (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 0x3f));
}

function line(s = ""): number[] {
  return [...text(s), 0x0a];
}

function row(label: string, value: string, width = 32): number[] {
  const gap = Math.max(1, width - label.length - value.length);
  return line(label + " ".repeat(gap) + value);
}

function qr(data: string): number[] {
  const bytes = text(data);
  const len = bytes.length + 3;
  return [
    GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00, // model 2
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 0x06, // module size 6
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31, // error correction M
    GS, 0x28, 0x6b, len & 0xff, len >> 8, 0x31, 0x50, 0x30, ...bytes, // store
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30, // print
  ];
}

export function ticketBytes(t: TicketSlip): Uint8Array {
  const out: number[] = [
    ESC, 0x40, // init
    ESC, 0x61, 1, // center
    ESC, 0x45, 1, GS, 0x21, 0x11, ...line(t.title), GS, 0x21, 0x00, ESC, 0x45, 0,
    ...line("--------------------------------"),
    ESC, 0x45, 1, ...line(t.movie), ESC, 0x45, 0,
    ...line(),
    ESC, 0x61, 0, // left
    ...row("Hall", t.hall),
    ...row("Showtime", t.showtime),
    ...(t.category ? row("Class", t.category) : []),
    ESC, 0x45, 1, GS, 0x21, 0x11, ...line(`SEAT ${t.seat}`), GS, 0x21, 0x00, ESC, 0x45, 0,
    ...line(),
    ESC, 0x61, 1,
    ...(t.qr ? [...qr(t.qr), 0x0a] : []),
    ...line(t.reference),
    ...line("--------------------------------"),
    ...(t.footer ? line(t.footer) : []),
    0x0a, 0x0a, 0x0a,
    GS, 0x56, 0x42, 0x00, // partial cut (ignored by printers without a cutter)
  ];
  return new Uint8Array(out);
}
