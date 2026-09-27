"use client";

import {
  CaretDownIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClockIcon,
  DotsThreeIcon,
  GitBranchIcon,
  TerminalIcon,
} from "@phosphor-icons/react";

/**
 * The deploy queue both figures put inside the panel: builds running, queued
 * and shipped. One component, so the panel in `Original` and the two in
 * `Cases` show the same interface and only their frames differ.
 *
 * It is a picture of an interface, so none of its controls are controls: they
 * are spans, and each figure carries one label for all of it.
 */

/* the avatars' indigo, scoped to this file. White initials clear 4.5:1 on it
   at the 12px they are set in, and keep their casing, being data */
const AVATAR = "#4f46e5";

export function Queue() {
  return (
    <div className="flex flex-col rounded-xl bg-surface px-2.5 py-1">
      <Section title="Building" count={1}>
        <Card>
          <div className="flex flex-col gap-2.5">
            <Item
              icon={
                <CircleNotchIcon className="size-3.5 text-text-secondary" />
              }
              title="feat: billing workspaces"
              branch="billing-split"
              hash="a1f93c2"
              initials="MK"
            />
            <div className="flex flex-col gap-1 rounded-md bg-surface p-2">
              <div className="flex items-center justify-between">
                <span className="text-meta text-text-muted">
                  Building preview
                </span>
                <TerminalIcon className="size-3 text-text-muted" />
              </div>
              <span className="font-mono text-meta text-text-muted">
                Installing deps, 42s
              </span>
            </div>
            {/* the two actions belong together, so they sit together */}
            <div className="flex items-center justify-end gap-1.5">
              <Chip>View logs</Chip>
              <Chip>Cancel</Chip>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Queued" count={2}>
        <div className="flex flex-col gap-2">
          <Row
            icon={<ClockIcon className="size-3.5 text-text-muted" />}
            title="fix: date picker offset"
            branch="fix-dates"
            hash="7c20e1b"
            initials="JR"
          />
          <Row
            icon={<ClockIcon className="size-3.5 text-text-muted" />}
            title="chore: bump next to 16.3"
            branch="deps"
            hash="e94b0d5"
            initials="AL"
          />
        </div>
      </Section>

      <Section title="Shipped" count={14}>
        <Row
          icon={<CheckCircleIcon className="size-3.5 text-success" />}
          title="perf: lazy load charts"
          branch="main"
          hash="3d8f6aa"
          initials="MK"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-stroke-soft border-t py-2.5 first:border-t-0">
      <div className="flex items-center gap-1.5 px-0.5">
        <CaretDownIcon className="size-3 text-text-muted" />
        <span className="text-meta text-text-secondary">{title}</span>
        <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-fill px-1.5 text-meta text-text-secondary tabular-nums">
          {count}
        </span>
        <DotsThreeIcon className="size-3.5 text-text-muted" />
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stroke bg-bg p-2.5">
      {children}
    </div>
  );
}

/* a queued or shipped build, a card holding one `Item` */
function Row(props: ItemProps) {
  return (
    <Card>
      <Item {...props} />
    </Card>
  );
}

interface ItemProps {
  icon: React.ReactNode;
  title: string;
  branch: string;
  hash: string;
  initials: string;
}

/* one build: the status icon, message and author on one centred line, and
   the branch and hash hanging under the message, not under the icon */
function Item({ icon, title, branch, hash, initials }: ItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="grid size-3.5 shrink-0 place-items-center">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-action text-text-primary">
          {title}
        </span>
        <Avatar initials={initials} />
      </div>
      <div className="pl-5.5">
        <Meta branch={branch} hash={hash} />
      </div>
    </div>
  );
}

/* branch and short hash, both data, so both mono */
function Meta({ branch, hash }: { branch: string; hash: string }) {
  return (
    <div className="flex items-center gap-1.5 text-meta text-text-muted">
      <GitBranchIcon className="size-3 shrink-0" />
      <span className="truncate font-mono">{branch}</span>
      <span
        aria-hidden="true"
        className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
      />
      <span className="font-mono">{hash}</span>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-full text-meta [text-transform:none]"
      style={{ background: AVATAR, color: "#fff" }}
    >
      {initials}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-stroke px-1.5 py-1 text-meta text-text-primary">
      {children}
    </span>
  );
}
