"use client";

import { useState, useCallback } from "react";
import styles from "./CodeBlock.module.css";

interface CodeBlockProps {
  readonly code: string;
  readonly id?: string;
}

export function CodeBlock({ code, id }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className={styles.wrapper} data-id={id}>
      <button className={styles.copyBtn} onClick={handleCopy}>
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className={styles.pre}>{code}</pre>
    </div>
  );
}
