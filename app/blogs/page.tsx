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

          <div className="lowercase bg-border/20 text-center p-4 rounded-lg text-xs text-muted-foreground">
            <p>Coming Soon - check back in a day or two</p>
          </div>

          {/* <Link href={`#`}>
            <div className="lowercase border border-gray-400/15 rounded-md p-3">
              <div className="space-y-3">
                <h1 className="text-sm lowercase">
                  some random title that is of certain length
                </h1>
                <p className="text-xs text-muted-foreground lowercase">
                  Lorem ipsum dolor sit amet consectetur, adipisicing elit.
                  Officiis, saepe dicta deleniti animi perspiciatis repellendus
                  perferendis ut eveniet sint consequuntur omnis laboriosam
                </p>
              </div>
              <div className="mt-3 text-muted-foreground flex gap-6 items-center">
                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <CalendarIcon width={13} height={13} />
                  2024-04-05
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <EyeClosedIcon width={13} height={13} />
                  100 views
                </p>

                <p className="text-[0.70em] rounded-md w-fit flex items-center gap-1.5">
                  <ClockIcon width={13} height={13} />5 min read
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
