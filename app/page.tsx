import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import {
  LuBookOpenCheck,
  LuFile,
  LuGithub,
  LuLinkedin,
  LuMail,
} from "react-icons/lu";
import Image from "next/image";
import Work from "@/components/Work";
import Projects from "@/components/Projects";
import Music from "@/components/Music";
import GetInTouch from "@/components/GetInTouch";
import { Link } from "next-view-transitions";

export default function Home() {
  return (
    <MaxWidthWrapper>
      <div className="my-32 sm:my-52">
        <Image
          src="/logo.png"
          height={30}
          width={30}
          alt="logo"
          draggable="false"
          className="select-none -rotate-45"
        />

        <div className="mt-6 space-y-4">
          <h1 className="font-medium text-sm lowercase">
            Sanyam is a full-stack web developer from india
          </h1>

          <p className="text-muted-foreground text-sm lowercase">
            As a developer, I believe simplicity is essential for a great user
            experience. Clean design and efficient code make a big difference.
          </p>

          <p className="text-muted-foreground text-sm lowercase">
            This summer, I interned at{" "}
            <a
              href="https://zenduty.com"
              target="_blank"
              className="border border-gray-400/15 rounded-md bg-border py-[2px] px-[4px] inline-block space-x-1 transition-all hover:text-primary"
            >
              <code>Zenduty</code>
              <Image
                src="/org/zenduty.png"
                className="rounded-full inline-block select-none"
                height={17}
                width={17}
                alt="zenduty-logo"
                draggable="false"
              />
            </a>{" "}
            as a front-end engineer, where I developed user interfaces. I&apos;m
            also leading development at my startup,{" "}
            <a
              href="https://flib.store"
              target="_blank"
              className="border border-gray-400/15 rounded-md bg-border py-[2px] px-[4px] inline-block space-x-1 transition-all hover:text-primary"
            >
              <code>Flib</code>
              <Image
                src="/org/flib.png"
                className="rounded-md inline-block select-none"
                height={17}
                width={17}
                alt="flib-logo"
                draggable="false"
              />
            </a>
            .
          </p>

          <p className="text-muted-foreground text-sm lowercase">
            I also write technical blogs sharing insights from my projects.
            Check them out{" "}
            <Link
              href="/blogs"
              className="underline underline-offset-2 text-white"
            >
              here
            </Link>
            .
          </p>

          <div className="bg-border/20 rounded-md py-4 px-4 flex items-center text-neutral-400 mt-8 mb-4">
            <div className="rounded-full bg-green-400 h-[8px] w-[8px] inline-block mr-2"></div>
            <div className="absolute animate-ping rounded-full bg-green-400 h-[8px] w-[8px] mr-2 "></div>

            <p className="text-muted-foreground text-xs lowercase">
              Actively seeking full-time front-end dev roles.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center -ml-2 gap-0.5">
          <a
            href="https://github.com/SanyamPunia"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuGithub
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="https://www.linkedin.com/in/sanyampunia/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuLinkedin
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="mailto:lewarends@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuMail
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="https://medium.com/@sanyamm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuBookOpenCheck
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
          <a
            href="/files/sanyam_cv.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuFile
              className="transition-all rounded-lg hover:bg-secondary p-2"
              size={33}
            />
          </a>
        </div>

        <Work />
        <Projects />
        <Music />

        {/* <GetInTouch /> */}
      </div>
    </MaxWidthWrapper>
  );
}
