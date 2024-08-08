import React from "react";
import {
  FaArrowRight,
  FaSoundcloud,
  FaSpotify,
  FaYoutube,
} from "react-icons/fa";

type Props = {};

const Music = (props: Props) => {
  return (
    <div className="mt-16 sm:-mx-2 text-xs">
      <h1 className="text-xs text-muted-foreground mb-3">/music</h1>

      {/* border-l-4  */}
      <p className="mb-3 text-sm lowercase px-3 py-2 -mx-3 text-muted-foreground">
        In 2020, I released my <span className="text-[#3df17c]">music</span>{" "}
        online, reaching over{" "}
        <span className="text-white font-semibold">150,000</span> plays across
        platforms, including{" "}
        <span className="text-white font-semibold">75,000+</span> on SoundCloud
        in 1.5 years.
      </p>

      <p className="mb-3 text-sm lowercase px-3 py-2 -mx-3 text-muted-foreground">
        I usually release music on{" "}
        <a
          href="https://soundcloud.com/prodmxle"
          target="_blank"
          className="border border-gray-400/15 rounded-md bg-border py-[2px] px-[4px] inline-block space-x-2 transition-all hover:text-primary"
        >
          <code>SoundCloud</code>
          <FaSoundcloud className="inline-block" size={17} color="#ff7700" />
        </a>
        ,{" "}
        <a
          href="https://open.spotify.com/artist/2QbtOIjb8mUIsnCNqvyWAW?nd=1&dlsi=d5f341b22e524b63"
          target="_blank"
          className="border border-gray-400/15 rounded-md bg-border py-[2px] px-[4px] inline-block space-x-2 transition-all hover:text-primary"
        >
          <code>Spotify</code>
          <FaSpotify className="inline-block" size={17} color="#1DB954" />
        </a>
        , and type beats on{" "}
        <a
          href="https://www.youtube.com/@prodmxle"
          target="_blank"
          className="border border-gray-400/15 rounded-md bg-border py-[2px] px-[4px] inline-block space-x-2 transition-all hover:text-primary"
        >
          <code>YouTube</code>
          <FaYoutube className="inline-block" size={17} color="#FF0000" />
        </a>
        . Feel free to check them out.
      </p>
    </div>
  );
};

export default Music;
