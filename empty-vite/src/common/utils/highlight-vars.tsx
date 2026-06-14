export function highlightVars(text: string, backgroundColor: string) {
  return text.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? <span key={i} style={{ backgroundColor, borderRadius: 3, padding: "1px 4px" }}>{part}</span>
      : part
  );
}
