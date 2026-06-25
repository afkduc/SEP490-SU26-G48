export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="layout-footer">
      <p>&copy; {year} SEP490-G48. All rights reserved.</p>
    </footer>
  );
}
