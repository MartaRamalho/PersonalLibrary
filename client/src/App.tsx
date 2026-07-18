import { FC } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Search } from "./pages/search/Search";
import { Shelves } from "./pages/shelves/Shelves";
import { ShelfDetail } from "./pages/shelf-detail/ShelfDetail";
import { ReadingYear } from "./pages/reading-year/ReadingYear";
import { Picker } from "./pages/picker/Picker";
import { BookDetail } from "./pages/book-detail/BookDetail";
import { BookPreview } from "./pages/book-preview/BookPreview";
import { ThemeToggle } from "./components/theme-toggle/ThemeToggle";

const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/search", label: "Search" },
  { to: "/shelves", label: "Shelves" },
  { to: "/reading", label: "Reading Years" },
  { to: "/picker", label: "Book Picker" },
];

export const App: FC = () => {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-surface/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-6">
          <NavLink
            to="/"
            className="font-display text-xl font-bold tracking-tight"
          >
            📚 Personal Library
          </NavLink>
          <nav className="flex gap-1 text-sm">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full transition-colors ${
                    isActive ? "bg-accent text-parchment" : "hover:bg-ink/5"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/search" element={<Search />} />
          <Route path="/shelves" element={<Shelves />} />
          <Route path="/shelf/:key" element={<ShelfDetail />} />
          <Route path="/reading" element={<ReadingYear />} />
          <Route path="/reading/:year" element={<ReadingYear />} />
          <Route path="/picker" element={<Picker />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/preview" element={<BookPreview />} />
        </Routes>
      </main>
    </div>
  );
};
