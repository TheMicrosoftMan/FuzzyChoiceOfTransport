// оцінка ціни (дорого, середнє, дешево) ()
// оцінка комфорту ((рівень зношеності) - не зручно, середня зручність, зручно)
// оцінка часу очікування ((популярність маршрута) - довго, задовільно, швидко)
// оцінка тривалості поїздки (довго, задовільно, швидко)
// оцінка кількості пересадок (з більше 1 пересадок, з 1 пересадкою, без пересадок)

const fuzzylogic = require("fuzzylogic");
const axios = require("axios");
const {parse} = require("node-html-parser");
const {buses, marshrutkas, tram, trol} = require('./transports');
const readline = require('readline');

getCoordineate = async data => {
  return new Promise((resolve, reject) => {
    let place = parsePlace(data);
    let url = `https://geocoder.api.here.com/6.2/geocode.json?searchtext=${place}&app_id=bC4fb9WQfCCZfkxspD4z&app_code=K2Cpd_EKDzrZb1tz0zdpeQ&gen=9`;
    axios
      .get(url)
      .then(response => {
        resolve({
          coordinte:
            response.data.Response.View[0].Result[0].Location.DisplayPosition,
          address:
            response.data.Response.View[0].Result[0].Location.Address.Label
        });
      })
      .catch(error => {
        reject(error);
      });
  });
};

parsePlace = data => {
  return encodeURI(data.toLowerCase());
};

get2Coordianates = async (waypoint1, waypoint2) => {
  return {
    waypoint1: await getCoordineate(waypoint1),
    waypoint2: await getCoordineate(waypoint2)
  };
};

getRoutes = async (start, finish) => {
  return new Promise(async (resolve, reject) => {
    let points = await get2Coordianates(start, finish);
    let url = `https://route.api.here.com/routing/7.2/calculateroute.json?alternatives=9&app_code=K2Cpd_EKDzrZb1tz0zdpeQ&app_id=bC4fb9WQfCCZfkxspD4z&avoidTransportTypes=&departure=2019-03-30T12:37:17&jsonAttributes=41&language=uk&legattributes=all&linkattributes=none,sh,ds,rn,ro,nl,pt,ns,le,fl&maneuverattributes=all&metricSystem=metric&mode=fastest;publicTransportTimeTable;traffic:disabled&routeattributes=none,sh,wp,sm,bb,lg,no,li,tx,la&transportMode=publicTransport&walkSpeed=1.4&waypoint0=geo!${
      points.waypoint1.coordinte.Latitude
    },${points.waypoint1.coordinte.Longitude}&waypoint1=geo!${
      points.waypoint2.coordinte.Latitude
    },${points.waypoint2.coordinte.Longitude}`;
    axios
      .get(url)
      .then(response => {
        resolve(parseRoutes(response.data.response.route));
      })
      .catch(error => {
        reject(error);
      });
  });
};

getPublicTransportLine = line => {
  let transportLineArray = [];
  line.forEach(el => {
    let { transportType, price, comfort } = getTransportType(el.lineName);
    transportLineArray.push({
      lineName: el.lineName,
      transportType: transportType,
      price: price,
      comfort: comfort
    });
  });
  return transportLineArray;
};

getTransportType = num => {
  if (buses.includes(num)) {
    return {
      transportType: "bus",
      price: 5,
      comfort: 90
    };
  } else if (marshrutkas.includes(num)) {
    return {
      transportType: "marshrutka",
      price: 6,
      comfort: 90
    };
  } else if (trol.includes(num)) {
    return {
      transportType: "trol",
      price: 4,
      comfort: 30
    };
  }
};

parseRoutes = data => {
  let routes = [];
  data.forEach(el => {
    routes.push({
      transportLine: getPublicTransportLine(el.publicTransportLine),
      duration: el.leg[0].travelTime,
      countOfTranspalnt: el.publicTransportLine.length,
      instruction: getInstruction(el.leg[0].maneuver)
    });
  });
  return routes;
};

getInstruction = maneuver => {
  let intr = "";
  maneuver.forEach(el => {
    intr += `${parse(`<div>${el.instruction}</div>`).rawText} \n`;
  });
  return intr;
}

determinePrice = transportLine => {
  let sumPrice = 0;
  transportLine.forEach(el => {
    sumPrice += el.price;
  });
  let veryGood = fuzzylogic.trapezoid(sumPrice, 0, 0, 4, 5);
  let good = fuzzylogic.trapezoid(sumPrice, 4, 5, 6, 7);
  let normal = fuzzylogic.trapezoid(sumPrice, 7, 8, 9, 10);
  let bad = fuzzylogic.trapezoid(sumPrice, 10, 11, 100, 100);
  if (veryGood > good && veryGood > normal && veryGood > bad) {
    return 9;
  } else if (good > normal && good > bad) {
    return 7;
  } else if (normal > good && normal > bad) {
    return 5;
  } else {
    return 3;
  }
};

determineComfort = transportLine => {
  let resultMark = 0;
  transportLine.forEach(el => {
    let bad = fuzzylogic.trapezoid(el.comfort, 0, 0, 30, 35);
    let normal = fuzzylogic.trapezoid(el.comfort, 30, 35, 70, 75);
    let good = fuzzylogic.trapezoid(el.comfort, 70, 75, 100, 100);
    if (bad > normal && bad > good) {
      resultMark += 5;
    } else if (normal > bad && normal > good) {
      resultMark += 7;
    } else {
      resultMark += 9;
    }
  });
  return resultMark;
};

determineWaitTime = time => {
  let good = fuzzylogic.trapezoid(time, 0, 0, 3, 5);
  let normal = fuzzylogic.trapezoid(time, 4, 5, 9, 10);
  let bad = fuzzylogic.trapezoid(time, 10, 11, 100, 100);
  if (good > normal && good > bad) {
    return 9;
  } else if (normal > good && normal > bad) {
    return 7;
  } else {
    return 5;
  }
};

determineDuration = seconds => {
  let minutes = seconds / 60;
  let good = fuzzylogic.trapezoid(minutes, 0, 0, 15, 20);
  let normal = fuzzylogic.trapezoid(minutes, 18, 25, 40, 45);
  let bad = fuzzylogic.trapezoid(minutes, 43, 50, 70, 100);
  if (good > normal && good > bad) {
    return 9;
  } else if (normal > good && normal > bad) {
    return 7;
  } else {
    return 5;
  }
};

determineTransplants = transplants => {
  let good = fuzzylogic.trapezoid(transplants, 0, 0, 1, 1);
  let normal = fuzzylogic.trapezoid(transplants, 1, 2, 2, 3);
  let bad = fuzzylogic.trapezoid(transplants, 2, 3, 3, 4);
  let veryBad = fuzzylogic.trapezoid(transplants, 3, 4, 100, 100);
  if (good > normal && good > bad && good > veryBad) {
    return 9;
  } else if (normal > good && normal > bad && normal > veryBad) {
    return 7;
  } else if (bad > veryBad && bad > bad && bad > good) {
    return 5
  } else {
    return 3;
  }
};

fuzzyScheme = route => {
  let fuzzyPrice =  determinePrice(route.transportLine),
    fuzzyComfort = determineComfort(route.transportLine),
    fuzzyDuration = determineDuration(route.duration),
    fuzzyTranspalnts = determineTransplants(route.countOfTranspalnt);
  let fuzzyMark =
    fuzzyPrice +
    fuzzyComfort +
    fuzzyDuration +
    fuzzyTranspalnts;
  return fuzzyMark;
};

getRouteFuzzyMark = routers => {
    let routersWithMarks = [];
    routers.forEach(el => {
        routersWithMarks.push({
            el,
            fuzzyMark: fuzzyScheme(el)
        })
    });
    return routersWithMarks;
}

sort = (arr) => {
  return arr.sort((a, b) => {
      if (a.fuzzyMark < b.fuzzyMark) {
          return -1;
      } else if (a.fuzzyMark > b.fuzzyMark) {
          return 1;
      } else {
          return 0;
      }
  });
};

showAllRoutes = routes => {
  console.log("\x1b[42m", `Most better route for you is an ${routes[0].el.transportLine[0].lineName} ${routes[0].el.transportLine[0].transportType}\n`);
  routes.forEach(el => {
    if (el.el.transportLine.length > 1) {
      console.log("\x1b[44m", "Route for you with transplants. First go to");
      el.el.transportLine.forEach(ell => {
        console.log("\x1b[45m", `   ${ell.lineName} ${ell.transportType} then`);
        console.log("\x1b[0m", el.el.instruction);
    });
    } else {
      console.log("\x1b[44m", `Route for you ${el.el.transportLine[0].lineName} ${el.el.transportLine[0].transportType}`);  
      console.log("\x1b[0m", el.el.instruction);
    }    
  });
}

main = async () => {
  let result = await getRoutes("вінниця чехова", "вінниця соборна");
  let res = await getRouteFuzzyMark(result);
  let sorted = sort(res);
  showAllRoutes(sorted);
};

main();
