"use client";

import { GearIcon, SignOutIcon, UserIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Demo } from "@/components/blogs/demo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The post's demo: the same trigger twice, once without an open state and once
 * with. Colocated because nothing else uses it.
 *
 * The state styling has to sit on the avatar, not the button. The avatar fills
 * the button completely, so a background on the button is simply covered.
 * Radix puts `data-state="open"` on the trigger, so the avatar reads it back
 * up through `group-data-[state=open]`.
 */

const ITEMS = [
  { label: "Profile", icon: UserIcon },
  { label: "Settings", icon: GearIcon },
];

const AVATAR =
  "grid size-8 place-items-center rounded-full bg-fill text-meta leading-none text-text-primary ring-1 ring-stroke ring-inset transition-all duration-200";

const TRIGGER =
  "group cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15";

function Menu({
  open,
  onOpenChange,
  avatarClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarClassName?: string;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger className={TRIGGER}>
        <span className={cn(AVATAR, avatarClassName)}>u</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>user@example.com</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map(({ label, icon: Icon }) => (
          <DropdownMenuItem key={label}>
            <Icon aria-hidden="true" className="size-3.75 shrink-0" />
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <SignOutIcon aria-hidden="true" className="size-3.75 shrink-0" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DropdownDemo() {
  const [plain, setPlain] = useState(false);
  const [stateful, setStateful] = useState(false);

  return (
    <Demo>
      <div className="flex items-start justify-center gap-14">
        <div className="flex flex-col items-center gap-3">
          <p className="text-meta text-text-muted">without open state</p>
          {/* hover only. The moment the menu opens the pointer leaves and the
              trigger snaps back, so nothing on screen says it is the source */}
          <Menu
            open={plain}
            onOpenChange={setPlain}
            avatarClassName="group-hover:bg-fill-hover"
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-meta text-text-muted">with open state</p>
          {/* the same hover, plus a state it holds for as long as the menu is
              open, so the trigger and its content stay visibly connected */}
          <Menu
            open={stateful}
            onOpenChange={setStateful}
            avatarClassName="group-hover:bg-fill-hover group-data-[state=open]:bg-fill-hover group-data-[state=open]:ring-stroke-strong group-data-[state=open]:text-text-primary"
          />
        </div>
      </div>
    </Demo>
  );
}
