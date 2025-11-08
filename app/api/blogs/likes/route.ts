import { doc, getDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import { BLOG_LIKES_COLLECTION, isValidBlogSlug } from "@/lib/blog-likes";
import { db } from "@/lib/firebase";

type LikesResponse = Record<string, number>;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const candidateSlugs: unknown = body?.slugs;
    if (!Array.isArray(candidateSlugs)) {
      return NextResponse.json(
        { error: "Invalid payload", likes: {} },
        { status: 400 },
      );
    }

    const slugs = Array.from(
      new Set(
        candidateSlugs
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

    if (slugs.length === 0) {
      return NextResponse.json({ likes: {} }, { status: 200 });
    }

    const validSlugs = slugs.filter(isValidBlogSlug);

    const entries = await Promise.all(
      validSlugs.map(async (slug) => {
        try {
          const docRef = doc(db, BLOG_LIKES_COLLECTION, slug);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const count = typeof data.count === "number" ? data.count : 0;
            return [slug, count] as const;
          }
        } catch (error) {
          console.error(`Error fetching likes for slug ${slug}:`, error);
        }
        return [slug, 0] as const;
      }),
    );

    const likes: LikesResponse = Object.fromEntries(entries);

    return NextResponse.json(
      { likes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching bulk likes:", error);
    return NextResponse.json(
      { error: "Failed to fetch likes", likes: {} },
      { status: 500 },
    );
  }
}
