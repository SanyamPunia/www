"use client";

interface CodeParserProps {
  text: string;
  className?: string;
}

const CodeParser: React.FC<CodeParserProps> = ({ text, className = "" }) => {
  const parseText = (input: string) => {
    const parts = input.split(/(`[^`]+`)/g);

    return parts.map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        const codeText = part.slice(1, -1);
        return (
          <code
            key={part}
            className="px-1 py-0.5 rounded-sm text-xs bg-neutral-900 text-neutral-200"
          >
            {codeText}
          </code>
        );
      }
      return part;
    });
  };

  return <span className={className}>{parseText(text)}</span>;
};

export default CodeParser;
