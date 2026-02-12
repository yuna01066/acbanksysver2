import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center h-10",
        caption_label: "text-sm font-semibold tracking-tight text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "inline-flex items-center justify-center",
          "h-8 w-8 rounded-full",
          "bg-transparent hover:bg-accent/80 active:scale-95",
          "text-muted-foreground hover:text-foreground",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground/70 rounded-md w-10 font-medium text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: cn(
          "relative h-10 w-10 p-0 text-center text-sm",
          "focus-within:relative focus-within:z-20",
          "[&:has([aria-selected].day-range-end)]:rounded-r-full",
          "[&:has([aria-selected].day-outside)]:bg-accent/40",
          "[&:has([aria-selected])]:bg-accent/50",
          "first:[&:has([aria-selected])]:rounded-l-full",
          "last:[&:has([aria-selected])]:rounded-r-full"
        ),
        day: cn(
          "inline-flex items-center justify-center",
          "h-9 w-9 rounded-full",
          "text-sm font-normal",
          "transition-all duration-150 ease-out",
          "hover:bg-accent hover:text-accent-foreground hover:scale-105",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-primary text-primary-foreground font-semibold",
          "shadow-sm shadow-primary/30",
          "hover:bg-primary hover:text-primary-foreground",
          "focus:bg-primary focus:text-primary-foreground",
          "scale-105"
        ),
        day_today: cn(
          "relative text-primary font-semibold",
          "after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2",
          "after:h-1 after:w-1 after:rounded-full after:bg-primary"
        ),
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/30 aria-selected:text-muted-foreground aria-selected:opacity-40",
        day_disabled: "text-muted-foreground/30 hover:bg-transparent hover:scale-100 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
