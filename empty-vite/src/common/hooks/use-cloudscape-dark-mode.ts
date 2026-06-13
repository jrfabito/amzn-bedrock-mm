import { useState, useEffect } from "react";

export function useCloudscapeDarkMode() {
  const [isDark, setIsDark] = useState(
    () => document.body.classList.contains("awsui-dark-mode")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains("awsui-dark-mode"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
