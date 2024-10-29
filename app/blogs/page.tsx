import MaxWidthWrapper from "@/components/MaxWidthWrapper";
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

          <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3 mb-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  Integrating hygraph CMS with Next.js (v13)
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  In this article, we will set up hygraph CMS with Next.js 13
                  along with creating a schema model & its respective content.
                  We will also implement a few basic APIs to render data on our
                  front end.
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2023-02-02
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />5 min read
                </p>
              </div>
            </div>
          </Link>
          {/* <Link href={`/blogs/understanding-trpc-using-nextjs`}>
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
          </Link> */}
        </div>
      </div>
    </MaxWidthWrapper>
  );
};

export default page;
