export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-6 px-6 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-graytext">
        <span>&copy; 2026 PayRanker.io</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="/privacy" className="hover:text-magenta">Privacy Policy</a>
          <span aria-hidden className="text-gray-300">|</span>
          <a href="/terms" className="hover:text-magenta">Terms of Service</a>
          <span aria-hidden className="text-gray-300">|</span>
          <a href="/cookies" className="hover:text-magenta">Cookie Notice</a>
          <span aria-hidden className="text-gray-300">|</span>
          <a href="/contact" className="hover:text-magenta">Contact Us</a>
        </nav>
      </div>
    </footer>
  );
}
