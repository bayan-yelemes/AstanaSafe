import { useEffect, useState } from "react";

import { getDistrictsGeojson } from "../services/roadsService";
import { reportError } from "../utils/logger";

export default function useDistrictsGeojson() {
  const [districtsGeojson, setDistrictsGeojson] = useState(null);

  useEffect(() => {
    let active = true;

    getDistrictsGeojson()
      .then((data) => {
        if (active) {
          setDistrictsGeojson(data);
        }
      })
      .catch((error) => {
        reportError("Failed to load districts:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  return districtsGeojson;
}
