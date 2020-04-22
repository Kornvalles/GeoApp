import IPosition from "../interfaces/Position"
import IPost from "../interfaces/Post"

/*
According to this calculator one Degree of latitude (at lattitude:55.772780384609256 ) 
corresponds to 111337.6487 meters, so one meter corresponds to 1/111337.6487 degrees
http://www.csgnetwork.com/degreelenllavcalc.html

const latInside = 55.772780384609256 + ((DISTANCE_TO_CENTER - 1) / 111337.6487)
const latOutside = 55.772780384609256 + ((DISTANCE_TO_CENTER + 1) / 111337.6487)
*/

function getLatitudeInside(latitude: number, radius: number) {
  return latitude + ((radius - 1) / 111337.6487)
}
function getLatitudeOutside(latitude: number, radius: number) {
  return latitude + ((radius + 1) / 111337.6487)
}

function positionCreator(lon: number, lat: number, userName: string, name: string, dateInFuture: boolean): IPosition {
  let date = new Date()
  if (dateInFuture) {
    date = new Date("2022-09-25T20:40:21.899Z")
  }
  var position: IPosition = {
    userName, name, lastUpdated: date,
    location: {
      type: "Point",
      coordinates: [lat, lon]
    }
  };

  return position;
}

const gameArea = {
  "type": "Polygon",
  "coordinates": [
    [
      [
        12.544240951538086,
        55.77594546428934
      ],
      [
        12.549219131469727,
        55.77502825125135
      ],
      [
        12.568359375,
        55.77604201177451
      ],
      [
        12.578487396240234,
        55.7767661102896
      ],
      [
        12.573423385620117,
        55.79467119920912
      ],
      [
        12.57059097290039,
        55.795877445664104
      ],
      [
        12.544240951538086,
        55.77594546428934
      ]
    ]
  ]
}


export { getLatitudeInside, getLatitudeOutside, positionCreator, gameArea }

