import AppHeader from "./AppHeader";
import Footer from "./Footer";

export default function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-warmwhite flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 pt-10 pb-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3 leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg text-graytext mb-8 leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed space-y-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-800 [&_h2]:mt-8 [&_h2]:mb-3 [&_a]:text-magenta [&_a:hover]:text-magenta-dark [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
