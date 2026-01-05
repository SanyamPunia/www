"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DropdownDemo() {
  const [withoutState, setWithoutState] = useState(false);
  const [withState, setWithState] = useState(false);

  return (
    <div className="my-8 flex items-start justify-center gap-12">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2 text-center">
            without state-based styling
          </h3>
        </div>

        <div className="flex justify-center">
          <DropdownMenu open={withoutState} onOpenChange={setWithoutState}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-10 w-10 cursor-pointer rounded-md overflow-hidden hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101010] focus:ring-emerald-500/50"
              >
                <div className="w-full h-full rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                  u
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-neutral-900 border border-[#1e1e1e] p-1"
            >
              <DropdownMenuLabel className="text-text-primary px-2 py-1.5 text-sm font-medium">
                user@example.com
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#1e1e1e] -mx-1 my-1 h-px" />
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <User className="size-4 mr-2" />
                profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <Settings className="size-4 mr-2" />
                settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1e1e1e] -mx-1 my-1 h-px" />
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <LogOut className="size-4 mr-2" />
                logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2 text-center">
            with state-based styling
          </h3>
        </div>

        <div className="flex justify-center">
          <DropdownMenu open={withState} onOpenChange={setWithState}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`h-10 w-10 cursor-pointer rounded-md overflow-hidden transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101010] focus:ring-emerald-500/50 ${
                  withState
                    ? "opacity-80 bg-neutral-800/30"
                    : "opacity-100 bg-transparent hover:opacity-80"
                }`}
              >
                <div className="w-full h-full rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                  u
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-neutral-900 border border-[#1e1e1e] p-1"
            >
              <DropdownMenuLabel className="text-text-primary px-2 py-1.5 text-sm font-medium">
                user@example.com
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#1e1e1e] -mx-1 my-1 h-px" />
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <User className="size-4 mr-2" />
                profile
              </DropdownMenuItem>
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <Settings className="size-4 mr-2" />
                settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1e1e1e] -mx-1 my-1 h-px" />
              <DropdownMenuItem className="text-text-primary hover:bg-neutral-800/50 cursor-pointer px-2 py-1.5 text-sm rounded-sm">
                <LogOut className="size-4 mr-2" />
                logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
