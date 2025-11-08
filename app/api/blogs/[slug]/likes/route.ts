import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { NextResponse } from "next/server";
import { BLOG_LIKES_COLLECTION, isValidBlogSlug } from "@/lib/blog-likes";
import { db } from "@/lib/firebase";

export async function GET(
  _request: unknown,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!isValidBlogSlug(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format", count: 0 },
        { status: 400 },
      );
    }

    const docRef = doc(db, BLOG_LIKES_COLLECTION, slug);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const count = typeof data.count === "number" ? data.count : 0;
      return NextResponse.json(
        { count },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }

    return NextResponse.json(
      { count: 0 },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching likes:", error);
    return NextResponse.json(
      { error: "Failed to fetch likes", count: 0 },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: unknown,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    if (!isValidBlogSlug(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format", success: false },
        { status: 400 },
      );
    }

    const docRef = doc(db, BLOG_LIKES_COLLECTION, slug);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        count: increment(1),
        updatedAt: serverTimestamp(),
      });

      const updatedSnap = await getDoc(docRef);
      const newCount =
        typeof updatedSnap.data()?.count === "number"
          ? updatedSnap.data()?.count
          : 0;

      return NextResponse.json(
        { count: newCount, success: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    } else {
      await setDoc(docRef, {
        slug,
        count: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return NextResponse.json(
        { count: 1, success: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  } catch (error) {
    console.error("Error incrementing likes:", error);
    return NextResponse.json(
      { error: "Failed to increment likes", success: false },
      { status: 500 },
    );
  }
}
