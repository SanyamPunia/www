export const BlinkingDot = () => {
  return (
    <div className="bg-border/20 relative rounded-md py-4 px-4 flex items-center text-neutral-400 mt-8 mb-4">
      <div className="rounded-full bg-green-400 h-[8px] w-[8px] inline-block mr-2"></div>
      <div className="absolute animate-ping rounded-full bg-green-400 h-[8px] w-[8px] mr-2 "></div>

      <p className="text-muted-foreground text-xs lowercase">
        Actively seeking full-time front-end dev roles.
      </p>
    </div>
  );
};

export default BlinkingDot;
