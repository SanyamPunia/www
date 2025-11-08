export const BLOG_LIKES_COLLECTION = "blog-likes";

export function isValidBlogSlug(slug: string): boolean {
  return (
    typeof slug === "string" &&
    /^[a-zA-Z0-9_-]+$/.test(slug) &&
    slug.length > 0 &&
    slug.length <= 200
  );
}
