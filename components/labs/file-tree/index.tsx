"use client";

import {
  CornersInIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
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
          <FolderOpenIcon className="size-4 shrink-0" />
        ) : (
          <FolderIcon className="size-4 shrink-0" />
        )
      ) : (
        <FileIcon className="size-4 shrink-0" />
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
    /*
     * These two heights move together. The wrapper is fixed, so growing only
     * the list below would push the card past the frame rather than making it
     * taller. The 38.4px difference is the card's breathing room in the frame.
     */
    <div className="flex h-132 w-full items-center justify-center">
      <main className="relative w-80 overflow-hidden rounded-lg ring-1 ring-stroke ring-inset bg-bg shadow-lg backdrop-blur-sm">
        {/*
         * The button is in flow rather than absolute over the list. Absolute,
         * its bottom edge landed exactly on the first row, so that row's
         * full-width hover fill ran under it, and because the clearance was
         * `pt-8` inside the scroll container it scrolled away and every row
         * passed beneath the button on the way up.
         */}
        <div className="flex items-center justify-end p-2 pb-0">
          <button
            type="button"
            onClick={handleCollapseAll}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-fill text-text-muted transition-colors duration-150 hover:bg-fill-hover hover:text-text-primary active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            aria-label="Collapse all"
          >
            <CornersInIcon className="size-3.5" />
          </button>
        </div>
        <ul className="max-h-112 space-y-0.5 overflow-y-auto p-2">
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
