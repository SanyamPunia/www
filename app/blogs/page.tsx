import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ClockIcon,
  DotFilledIcon,
  EyeClosedIcon,
  EyeNoneIcon,
  EyeOpenIcon,
  TimerIcon,
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

          {/* <div className="lowercase bg-border/20 text-center p-4 rounded-lg text-xs text-muted-foreground">
            <p>Coming Soon - check back in a day or two</p>
          </div> */}

          <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3">
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
                  <EyeClosedIcon width={13} height={13} />
                  50 views
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />5 min read
                </p>
              </div>
            </div>
          </Link>

          {/* <ul className="space-y-4 my-12">
            <li className="border-b pb-4">
              <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
                <h1 className="text-sm lowercase">
                  Integrating hygraph CMS with Next.js (v13)
                </h1>
              </Link>
            </li>

            <li className="border-b pb-4">
              <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
                <h1 className="text-sm lowercase mb-2">
                  Integrating hygraph CMS with Next.js (v13)
                </h1>
                <p className="text-xs text-muted-foreground flex gap-1 items-center">
                  <ClockIcon height={13} width={13} />2 min read
                </p>
              </Link>
            </li>

            <li className="border-b pb-4">
              <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
                <h1 className="text-sm lowercase">
                  Integrating hygraph CMS with Next.js (v13)
                </h1>
              </Link>
            </li>

            <li className="">
              <Link href={`/blogs/integrating-hygraph-cms-with-nextjs-v13`}>
                <h1 className="text-sm lowercase">
                  Integrating hygraph CMS with Next.js (v13)
                </h1>
              </Link>
            </li>
          </ul> */}
        </div>
      </div>
    </MaxWidthWrapper>
  );
};

export default page;
