import React from "react";

type Props = {};

const GetInTouch = (props: Props) => {
  return (
    <div className="text-sm flex items-center sm:-mx-2  text-neutral-400 mt-8 mb-4">
      <div className="rounded-full bg-green-400 h-[8px] w-[8px] inline-block mr-2"></div>
      <div className="absolute animate-ping rounded-full bg-green-400 h-[8px] w-[8px] mr-2 "></div>

      <p className="text-muted-foreground text-sm lowercase">
        Actively seeking full-time front-end roles.
      </p>
    </div>
  );
};

export default GetInTouch;
