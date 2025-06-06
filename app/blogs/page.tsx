import MaxWidthWrapper from "@/components/max-width-wrapper";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClockIcon,
} from "@radix-ui/react-icons";
import { Link } from "next-view-transitions";
import React from "react";

type Props = {};

const page = async (props: Props) => {
  return (
    <MaxWidthWrapper>
      <div className="my-32 sm:my-52">
        <Link href="/" className="text-xs flex items-center -ml-1">
          <ChevronLeftIcon width={13} height={13} />
          back
        </Link>
        <div className="mt-6">
          <h1 className="text-muted-foreground text-sm lowercase">
            I occasionally write technical articles to share details about what
            I&apos;ve implemented and how I&apos;ve done it.
          </h1>

          <hr className="my-6" />

          <Link
            href={`/blogs/adding-draggable-spring-effect-on-image-using-framer-motion`}
          >
            <div className="lowercase border border-gray-400/15 rounded-md p-3 mb-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  Adding draggable-spring effect on image using framer motion
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  I recently created a draggable image with a spring effect
                  using Framer Motion—smooth scaling on drag and a bouncy
                  snap-back!
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2024-11-01
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />2 min read
                </p>
              </div>
            </div>
          </Link>

          <Link href={`/blogs/creating-blinking-dot-effect-using-tailwind`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3 mb-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  Creating blinking dot effect using tailwind
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  Let&apos;s create a simple blinking dot indicator can be a
                  great way to show users that a service is live on your
                  website.
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2024-11-01
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />2 min read
                </p>
              </div>
            </div>
          </Link>

          <Link href={`/blogs/recreating-stream-text-animation-hook`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3 mb-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  Recreating Stream Text Animation Hook
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  I recently re-created the popular one-liner hook to add a text
                  reveal animation to streams of incoming strings, which could
                  come from an external LLM source or a backend API response.
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2024-10-31
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />
                  10 min read
                </p>
              </div>
            </div>
          </Link>

          <Link href={`/blogs/understanding-trpc-using-nextjs`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  Understanding tRPC using Next.js
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  In this article, I would try to lay out my existing knowledge
                  of tRPC using Next.js, along with a recommended directory
                  structure.
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2023-03-19
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />7 min read
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </MaxWidthWrapper>
  );
};

export default page;
