/** Development-configuratie (standaard). In productie vervangen door `environment.prod.ts`. */
export const environment = {
  production: false,
  /** Basis-URL van de REST-API (relatief; in dev doorgestuurd via `proxy.conf.json`). */
  apiUrl: '/api',
  /** Prefix voor `image_path` / `image_url` van de backend (bv. `/uploads/x.webp`); leeg = zelfde origin. */
  mediaUrl: '',
};
