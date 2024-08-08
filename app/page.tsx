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

export default function Home() {
  return (
    <MaxWidthWrapper>
      <div className="my-52">
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
            sanyam is a full-stack web developer from india
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
                src="/zenduty.png"
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
                src="/flib.png"
                className="rounded-md inline-block select-none"
                height={17}
                width={17}
                alt="flib -logo"
                draggable="false"
              />
            </a>
            .
          </p>
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

        <GetInTouch />
      </div>
    </MaxWidthWrapper>
  );
}
