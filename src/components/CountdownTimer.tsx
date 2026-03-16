import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface CountdownTimerProps {
  expiresAt: string;
  compact?: boolean;
}

export default function CountdownTimer({ expiresAt, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("انتهت");
        setUrgent(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setUrgent(days === 0 && hours < 6);

      if (compact) {
        if (days > 0) setTimeLeft(`${days}ي ${hours}س`);
        else if (hours > 0) setTimeLeft(`${hours}س ${mins}د`);
        else setTimeLeft(`${mins}د ${secs}ث`);
      } else {
        if (days > 0) setTimeLeft(`${days} يوم ${hours} ساعة`);
        else if (hours > 0) setTimeLeft(`${hours} ساعة ${mins} دقيقة`);
        else setTimeLeft(`${mins} دقيقة ${secs} ثانية`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, compact]);

  return (
    <span className={`inline-flex items-center gap-0.5 ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
      {urgent ? <AlertTriangle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
      <span className={`${compact ? "text-[9px]" : "text-[10px]"} font-medium tabular-nums`}>
        {timeLeft}
      </span>
    </span>
  );
}
