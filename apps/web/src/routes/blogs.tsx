import { Link } from "react-router-dom";
import { ArrowLeft, CalendarIcon, ArrowRightIcon } from "@/components/ui/icons";
import { useBlogs } from "@/api/blogs";

export function Blogs() {
  const { data: blogs, isLoading } = useBlogs();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Blog</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Tips, guides, and updates about invoicing and Open-Bookkeeping.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !blogs?.length ? (
            <p className="text-muted-foreground text-center py-12">
              No blog posts yet. Check back soon!
            </p>
          ) : (
            <div className="space-y-8">
              {blogs.map((blog) => (
                <article
                  key={blog.slug}
                  className="group border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <Link to={`/blog/${blog.slug}`}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <CalendarIcon className="h-4 w-4" />
                      <time>{blog.date}</time>
                    </div>
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {blog.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {blog.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Read more
                      <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
