import BlogsIndex from "@/components/blogs/blogs-index";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import { getAllBlogs } from "@/lib/blogs";

export default async function Page() {
  const blogs = getAllBlogs();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
        animated={true}
        showTerminalHeader={true}
      >
        <BlogsIndex blogs={blogs} />
      </MaxWidthWrapper>
    </div>
  );
}
