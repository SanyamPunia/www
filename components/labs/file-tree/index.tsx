"use client";

import { AnimatePresence, motion } from "framer-motion";
import { File, Folder, FolderOpen, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import "./styles.css";

type TreeNode = {
  name: string;
  children?: TreeNode[];
};

const treeData: TreeNode[] = [
  {
    name: "app",
    children: [
      {
        name: "(marketing)",
        children: [
          { name: "layout.tsx" },
          { name: "page.tsx" },
          { name: "loading.tsx" },
        ],
      },
      {
        name: "(dashboard)",
        children: [{ name: "@analytics/page.tsx" }, { name: "@team/page.tsx" }],
      },
      { name: "layout.tsx" },
      { name: "globals.css" },
    ],
  },
  {
    name: "components",
    children: [
      {
        name: "ui",
        children: [
          { name: "button.tsx" },
          { name: "card.tsx" },
          { name: "theme-toggle.tsx" },
        ],
      },
      { name: "header.tsx" },
      { name: "footer.tsx" },
    ],
  },
  {
    name: "lib",
    children: [
      { name: "auth.ts" },
      { name: "db.ts" },
      {
        name: "hooks",
        children: [{ name: "useUser.ts" }, { name: "useTheme.ts" }],
      },
    ],
  },
  {
    name: "public",
    children: [
      { name: "favicon.ico" },
      {
        name: "images",
        children: [{ name: "hero.png" }, { name: "logo.svg" }],
      },
    ],
  },
];

const basePadding = 12;

function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.span
      animate={{ rotate: isOpen ? 90 : 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex size-3.5 items-center justify-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-label="Chevron"
        role="img"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </motion.span>
  );
}

function TreeItem({
  node,
  depth = 0,
  collapseSignal,
}: {
  node: TreeNode;
  depth?: number;
  collapseSignal: number;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (collapseSignal > 0) {
      setIsOpen(false);
    }
  }, [collapseSignal]);

  const content = (
    <span className="flex flex-1 items-center gap-2">
      {hasChildren ? (
        <Chevron isOpen={isOpen} />
      ) : (
        <span className="size-3.5" />
      )}
      {hasChildren ? (
        isOpen ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0" />
        )
      ) : (
        <File className="size-4 shrink-0" />
      )}
      <span className="truncate">{node.name}</span>
    </span>
  );

  return (
    <li className="select-none">
      {hasChildren ? (
        <motion.button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="tree-item cursor-pointer"
          whileHover={{ x: 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{ paddingLeft: basePadding + depth * basePadding }}
        >
          {content}
        </motion.button>
      ) : (
        <div
          className="tree-item cursor-default"
          style={{ paddingLeft: basePadding + depth * basePadding }}
        >
          {content}
        </div>
      )}

      {hasChildren && (
        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.ul
              key="content"
              initial="collapsed"
              animate="open"
              exit="collapsed"
              variants={{
                open: { height: "auto", opacity: 1 },
                collapsed: { height: 0, opacity: 0 },
              }}
              transition={{ duration: 0.24, ease: "easeInOut" }}
              className="space-y-0.5 overflow-hidden"
            >
              {node.children?.map((child) => (
                <TreeItem
                  key={child.name}
                  node={child}
                  depth={depth + 1}
                  collapseSignal={collapseSignal}
                />
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      )}
    </li>
  );
}

const FileTreeLab = () => {
  const [collapseSignal, setCollapseSignal] = useState(0);

  const handleCollapseAll = () => {
    setCollapseSignal((prev) => prev + 1);
  };

  return (
    <div className="flex h-72 w-full items-center justify-center border border-[#131313] rounded-sm bg-[#09090b]">
      <main className="relative w-80 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/10 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={handleCollapseAll}
          className="cursor-pointer absolute right-2 top-2 flex size-6 items-center justify-center rounded-lg bg-zinc-900/80 text-zinc-500 transition hover:text-zinc-100"
          aria-label="Collapse all"
        >
          <Minimize2 className="size-3.5" />
        </button>
        <ul className="space-y-0.5 p-2 pt-8 max-h-60 overflow-y-auto">
          {treeData.map((node) => (
            <TreeItem
              key={node.name}
              node={node}
              collapseSignal={collapseSignal}
            />
          ))}
        </ul>
      </main>
    </div>
  );
};

export default FileTreeLab;
