import { MorphingIconDemo } from "./morphing-icon-demo";

/*
 * No frame here. `Demo` already draws a white panel with a hairline, and this
 * used to draw an identical one inside it, so the two nested visibly.
 */
const page = () => {
  return (
    <div className="flex w-full items-stretch">
      <MorphingIconDemo />
    </div>
  );
};

export default page;
