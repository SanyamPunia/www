import Image from "next/image";
import React from "react";

type Props = {};

const Work = (props: Props) => {
  return (
    <div className="mt-16 sm:-mx-2 text-xs">
      <h1 className="text-xs text-muted-foreground mb-3">/work</h1>
      <a href="https://flib.store" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div>
            <Image
              src="/org/flib.png"
              height={37}
              width={37}
              className="rounded-full select-none"
              alt="flib-logo"
              draggable="false"
            />
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Flib</h1>
            <div className="lowercase text-muted-foreground flex justify-between items-center">
              <p>Founder/CEO</p>
              <p>2023 - Now</p>
            </div>
          </div>
        </div>
      </a>

      <a href="https://www.zenduty.com/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div>
            <Image
              src="/org/zenduty.png"
              height={37}
              width={37}
              className="rounded-full select-none"
              alt="zenduty-logo"
              draggable="false"
            />
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Zenduty</h1>
            <div className="lowercase text-muted-foreground flex justify-between items-center">
              <p>Frontend Engineer Intern</p>
              <p>s&apos;23 - s&apos;24</p>
            </div>
          </div>
        </div>
      </a>

      <a href="https://www.buildfast.co.in/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div>
            <Image
              src="/org/buildfast.jpeg"
              height={37}
              width={37}
              className="rounded-full select-none"
              alt="buildfast-logo"
              draggable="false"
            />
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Buildfast</h1>
            <div className="lowercase text-muted-foreground flex justify-between items-center">
              <p>Frontend Developer Intern</p>
              <p>Feb&apos;23 - Mar&apos;23</p>
            </div>
          </div>
        </div>
      </a>

      <a href="https://codein.withgoogle.com/archive/2018/" target="_blank">
        <div className="flex gap-4 transition-all hover:bg-secondary/40 rounded-xl px-4 -mx-4 pt-3">
          <div>
            <Image
              src="/org/google.jpg"
              height={37}
              width={37}
              className="rounded-full select-none"
              alt="google-logo"
              draggable="false"
            />
          </div>
          <div className="w-full pb-4 border-b border-secondary/40">
            <h1 className="font-medium">Google Code-In</h1>
            <div className="lowercase text-muted-foreground flex justify-between items-center">
              <p>Finalist | Score Lab</p>
              <p>Oct&apos;18 - Dec&apos;18</p>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Work;
