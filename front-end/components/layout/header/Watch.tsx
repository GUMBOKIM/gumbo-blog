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
      {time.getHours() >= 10 ? time.getHours() : `0${time.getHours()}`}
      :
      {time.getMinutes() >= 10 ? time.getMinutes() : `0${time.getMinutes()}`}
    </div>
  );
}
