/**
 * URLs of pages that show one record. The site is a static export, so these are fixed pages that read the record id
 * from the query string (the old /movies/<slug> style URLs are 301-redirected here by the root .htaccess).
 */
const withQuery = (path: string, key: string, value: string, hash = "") => `${path}?${key}=${encodeURIComponent(value)}${hash}`;

export const routes = {
  movie: (slug: string, hash?: "#showtimes") => withQuery("/movies/view/", "slug", slug, hash),
  event: (slug: string) => withQuery("/events/view/", "slug", slug),
  article: (slug: string) => withQuery("/news/view/", "slug", slug),
  seats: (showtimeId: string) => withQuery("/booking/seats/", "showtime", showtimeId),
  booking: (id: string) => withQuery("/account/bookings/view/", "id", id),
  newMovie: "/admin/movies/new/",
  editMovie: (id: string) => withQuery("/admin/movies/edit/", "id", id),
  newCinema: "/admin/cinemas/new/",
  editCinema: (id: string) => withQuery("/admin/cinemas/edit/", "id", id),
  adminBooking: (id: string) => withQuery("/admin/bookings/view/", "id", id),
  roomSeats: (roomId: string) => withQuery("/admin/cinemas/rooms/seats/", "room", roomId),
};
