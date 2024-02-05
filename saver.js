import React, { useEffect } from 'react';
import L from 'leaflet';

const RadarViewer = ({ initialLatitude, initialLongitude }) => {
  let map;
  let apiData = {};
  let mapFrames = [];
  let lastPastFramePosition = -1;
  let radarLayers = [];
  let animationPosition = 0;
  let animationTimer = false;

  let optionTileSize = 256;
  let optionColorScheme = 2;
  let optionKind = 'radar';  // 'radar' or 'satellite'
  let optionSmoothData = 1;
  let optionSnowColors = 1;

  const startLoadingTile = () => {};
  const finishLoadingTile = () => {};
  const isTilesLoading = () => false;

  const addLayer = (frame) => {
    if (!radarLayers[frame.path]) {
      const colorScheme = optionKind === 'satellite' ? 0 : optionColorScheme;
      const smooth = optionKind === 'satellite' ? 0 : optionSmoothData;
      const snow = optionKind === 'satellite' ? 0 : optionSnowColors;

      const source = new L.TileLayer(
        `${apiData.host}${frame.path}/${optionTileSize}/{z}/{x}/{y}/${colorScheme}/${smooth}_${snow}.png`,
        {
          tileSize: 256,
          opacity: 0.1,
          zIndex: frame.time,
        }
      );

      source.on('loading', startLoadingTile);
      source.on('load', finishLoadingTile);
      source.on('remove', finishLoadingTile);

      radarLayers[frame.path] = source;
    }
    if (!map.hasLayer(radarLayers[frame.path])) {
      map.addLayer(radarLayers[frame.path]);
    }
  };

  const changeRadarPosition = (position, preloadOnly, force) => {
    while (position >= mapFrames.length) {
      position -= mapFrames.length;
    }
    while (position < 0) {
      position += mapFrames.length;
    }

    const currentFrame = mapFrames[animationPosition];
    const nextFrame = mapFrames[position];

    addLayer(nextFrame);

    if (preloadOnly || (isTilesLoading() && !force)) {
      return;
    }

    animationPosition = position;

    if (radarLayers[currentFrame.path]) {
      radarLayers[currentFrame.path].setOpacity(0);
    }
    radarLayers[nextFrame.path].setOpacity(100);

    const pastOrForecast = nextFrame.time > Date.now() / 1000 ? 'FORECAST' : 'PAST';

    document.getElementById('timestamp').innerHTML = `${pastOrForecast}: ${new Date(
      nextFrame.time * 1000
    ).toString()}`;
  };

  const showFrame = (nextPosition, force) => {
    const preloadingDirection = nextPosition - animationPosition > 0 ? 1 : -1;

    changeRadarPosition(nextPosition, false, force);

    changeRadarPosition(nextPosition + preloadingDirection, true);
  };

  const stop = () => {
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = false;
      return true;
    }
    return false;
  };

  const play = () => {
    showFrame(animationPosition + 1);

    animationTimer = setTimeout(play, 500);
  };

  const playStop = () => {
    if (!stop()) {
      play();
    }
  };

  const setKind = (kind) => {
    initialize(apiData, kind);
  };

  const setColors = () => {
    const e = document.getElementById('colors');
    optionColorScheme = e.options[e.selectedIndex].value;
    initialize(apiData, optionKind);
  };

  const initialize = (api, kind) => {
    for (let i in radarLayers) {
      map.removeLayer(radarLayers[i]);
    }
    mapFrames = [];
    radarLayers = [];
    animationPosition = 0;

    if (!api) {
      return;
    }
    if (kind === 'satellite' && api.satellite && api.satellite.infrared) {
      mapFrames = api.satellite.infrared;
      lastPastFramePosition = api.satellite.infrared.length - 1;
      showFrame(lastPastFramePosition, true);
    } else if (api.radar && api.radar.past) {
      mapFrames = api.radar.past;
      if (api.radar.nowcast) {
        mapFrames = mapFrames.concat(api.radar.nowcast);
      }
      lastPastFramePosition = api.radar.past.length - 1;
      showFrame(lastPastFramePosition, true);
    }
  };

  useEffect(() => {
    map = L.map('mapid').setView([initialLatitude, initialLongitude], 13);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
      attribution: 'Map data &copy; <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox/satellite-v9',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'pk.eyJ1IjoicmFtcGFydHRlY2giLCJhIjoiY2xyOGh0aG5lMnFkczJqbmVxb2dxZng1eiJ9.uEAANYhorjlhjv5C_gD4JQ', // Replace with your Mapbox access token
    }).addTo(map);

    const apiRequest = new XMLHttpRequest();
    apiRequest.open('GET', 'https://api.rainviewer.com/public/weather-maps.json', true);
    apiRequest.onload = function (e) {
      apiData = JSON.parse(apiRequest.response);
      initialize(apiData, optionKind);
    };
    apiRequest.send();

    document.onkeydown = function (e) {
      e = e || window.event;
      switch (e.which || e.keyCode) {
        case 37: // left
          stop();
          showFrame(animationPosition - 1, true);
          break;

        case 39: // right
          stop();
          showFrame(animationPosition + 1, true);
          break;

        default:
          return;
      }
      e.preventDefault();
      return false;
    };

    return () => {
      if (animationTimer) {
        clearTimeout(animationTimer);
      }
      map.remove();
    };
  }, [initialLatitude, initialLongitude]);

  return (
    <div>
      <ul
        style={{
          textAlign: 'center',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50px',
        }}
      >
        <li>
          <input
            type="radio"
            name="kind"
            checked={optionKind === 'radar'}
            onChange={() => setKind('radar')}
          />
          Radar (Past + Future)
          <input
            type="radio"
            name="kind"
            checked={optionKind === 'satellite'}
            onChange={() => setKind('satellite')}
          />
          Infrared Satellite
        </li>

        <li>
          <input
            type="button"
            onClick={() => {
              stop();
              showFrame(animationPosition - 1, true);
            }}
            value="<"
          />
        </li>
        <li>
          <input type="button" onClick={playStop} value="Play / Stop" />
        </li>
        <li>
          <input
            type="button"
            onClick={() => {
              stop();
              showFrame(animationPosition + 1, true);
            }}
            value=">"
          />
        </li>

        <li>
          <select id="colors" onChange={setColors}>
            <option value="0">Black and White Values</option>
            <option value="1">Original</option>
            <option value="2" selected="selected">
              Universal Blue
            </option>
            <option value="3">TITAN</option>
            <option value="4">The Weather Channel</option>
            <option value="5">Meteored</option>
            <option value="6">NEXRAD Level-III</option>
            <option value="7">RAINBOW @ SELEX-SI</option>
            <option value="8">Dark Sky</option>
          </select>
        </li>
      </ul>

      <div
        id="timestamp"
        style={{
          textAlign: 'center',
          position: 'absolute',
          top: '50px',
          left: 0,
          right: 0,
          height: '80px',
        }}
      >
        FRAME TIME
      </div>

      <div
        id="mapid"
        style={{
          position: 'absolute',
          top: '80px',
          left: 0,
          bottom: 0,
          right: 0,
        }}
      ></div>
    </div>
  );
};

export default RadarViewer;
