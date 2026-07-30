"use client";

// Shared freehand/arrow/circle drawing-on-a-canvas logic, used by both the
// video annotator (drawing over a paused frame) and the image annotator
// (drawing over a static upload) — factored out so the two don't drift out
// of sync with slightly different pointer-handling bugs.

import { useEffect, useRef, useState, type PointerEvent } from "react";

export type AnnotationTool = "none" | "pen" | "circle" | "arrow";
export type Point = { x: number; y: number };
export type Shape = { tool: AnnotationTool; color: string; points: Point[] };

export const ANNOTATION_COLORS = ["#D4AF37", "#EF4444", "#22C55E", "#3B82F6", "#FFFFFF"];

export function useAnnotationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<AnnotationTool>("none");
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const drawing = useRef<Shape | null>(null);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = drawing.current ? [...shapes, drawing.current] : shapes;
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "pen") {
        ctx.beginPath();
        s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      } else if (s.tool === "circle" && s.points.length >= 2) {
        const [a, b] = s.points;
        const r = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === "arrow" && s.points.length >= 2) {
        const [a, b] = s.points;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }

  useEffect(redraw, [shapes]);

  function pointFromEvent(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (tool === "none") return;
    const p = pointFromEvent(e);
    drawing.current = { tool, color, points: [p] };
    redraw();
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = pointFromEvent(e);
    if (tool === "pen") drawing.current.points.push(p);
    else drawing.current.points[1] = p;
    redraw();
  }

  function handlePointerUp() {
    if (!drawing.current) return;
    setShapes((prev) => [...prev, drawing.current as Shape]);
    drawing.current = null;
  }

  function clearDrawing() {
    setShapes([]);
  }

  return {
    canvasRef, tool, setTool, color, setColor, redraw,
    handlePointerDown, handlePointerMove, handlePointerUp, clearDrawing,
  };
}
