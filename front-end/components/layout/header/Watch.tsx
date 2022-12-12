import React, { useEffect, useState } from "react";

export default function Watch() {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ml-auto sm:hidden animate-pulse">
      {time.getHours()}:{time.getMinutes()}
    </div>
  );
}
