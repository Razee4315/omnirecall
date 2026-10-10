/** A file from public/, wherever the site is hosted (at a domain root or under a path like /omnirecall/). */
export const asset = (path: string) => import.meta.env.BASE_URL + path
