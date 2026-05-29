"use client";

import { track } from "@/lib/track";

// An external <a> that fires a Plausible goal event on click. Lets server
// components (e.g. the event detail page) instrument outbound actions without
// becoming client components themselves.
export function TrackedLink({
  event,
  props,
  children,
  ...rest
}: {
  event: string;
  props?: Record<string, string | number | boolean>;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...rest} onClick={() => track(event, props)}>
      {children}
    </a>
  );
}
