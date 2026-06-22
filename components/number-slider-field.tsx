"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NumberSliderFieldProps = {
  name: string;
  label: string;
  defaultValue: string;
  min: number;
  max: number;
  step: number;
  placeholder?: string;
  required?: boolean;
};

export function NumberSliderField({
  name,
  label,
  defaultValue,
  min,
  max,
  step,
  placeholder = "填写数值",
  required,
}: NumberSliderFieldProps) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name={name}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-8 w-28 font-mono"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value || defaultValue}
        onChange={(event) => setValue(event.target.value)}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[var(--geist-blue-700)]"
        aria-label={label}
      />
    </div>
  );
}
