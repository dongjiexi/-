/* Convert explicit written relations to data-only construction specifications. */
(function (root) {
  'use strict';
  const point = '[A-Z](?:\\d{1,3})?′?';
  const named = '[a-z](?:[A-Z]|\\d{1,3})?′?';
  const line = '(?:' + point + point + '|' + named + ')';
  const side = '(?:线段|边|弦)';
  const capture = pattern => '(' + pattern + ')';
  const p = capture(point), l = capture(line);
  const nameStart = '(?<![A-Za-z0-9_′])';
  const angle = '(?:∠|角)' + p + p + p;
  const relationStart = '(?:^|[,、:：]|使得?|满足|且|并|有|可得|作)';
  const relationEnd = '(?=$|[,、:：]|且|并|使|满足|则|由|故|所以|因此)';
  const negative = /假设|假如|如果|倘若|若|或|反例|错误|误以为|尝试|不满足|不在|不等|不与|不成立|不相切|不垂直|不一定|未必|否定|无法|不能|是否|不应|不要|不必|无需|并非|[?？]/;
  const equalAngles = [
    new RegExp(relationStart + angle + '=' + angle + relationEnd, 'g'),
    new RegExp(relationStart + angle + '(?:与|和)' + angle + '相等' + relationEnd, 'g')
  ];
  const sideMembership = [
    new RegExp(nameStart + p + '在' + side + p + p + '上' + relationEnd, 'g'),
    new RegExp(nameStart + p + '∈' + side + p + p + relationEnd, 'g'),
    new RegExp(nameStart + p + '(?:为|是)' + side + p + p + '上(?:的)?一点' + relationEnd, 'g'),
    new RegExp('在' + side + p + p + '上(?:取|选|标记)(?:点)?' + p + relationEnd, 'g')
  ];
  const lineMembership = [
    new RegExp(nameStart + p + '在直线' + l + '上' + relationEnd, 'g'),
    new RegExp(nameStart + p + '∈直线' + l + relationEnd, 'g'),
    new RegExp(nameStart + p + '(?:为|是)直线' + l + '上(?:的)?一点' + relationEnd, 'g'),
    new RegExp('在直线' + l + '上(?:取|选|标记)(?:点)?' + p + relationEnd, 'g')
  ];
  const triangle = '(?:△|三角形)' + p + p + p;
  const onEdge = '(?:边)?' + p + p + '(?:边)?上的?';
  const medians = [
    new RegExp(nameStart + p + p + '(?:是|为)' + triangle + '的(?:一条)?中线' + relationEnd, 'g'),
    new RegExp(triangle + '中,?(?:作|画|取)(?:出)?中线' + p + p + relationEnd, 'g'),
    new RegExp(triangle + '中,?' + p + p + '(?:是|为)(?:一条)?中线' + relationEnd, 'g'),
    new RegExp('(?:作|画)(?:出)?' + triangle + '的中线' + p + p + relationEnd, 'g'),
    new RegExp(triangle + '中,?' + p + p + '(?:是|为)' + onEdge + '中线' + relationEnd, 'g')
  ];
  // Paired bars denote length. Leave expressions with extra factors or terms alone.
  const equalSegments = [
    new RegExp(relationStart + p + p + '=' + p + p + relationEnd, 'g'),
    new RegExp(relationStart + '\\|' + p + p + '\\|=\\|' + p + p + '\\|' + relationEnd, 'g')
  ];
  const midpointDefinitions = [
    new RegExp(nameStart + p + '(?:为|是)(?:' + side + ')?' + p + p + '的?中点' + relationEnd, 'g'),
    new RegExp('(?:' + side + ')?' + nameStart + p + p + '的?中点(?:为|是|记为)(?:点)?' + p + relationEnd, 'g'),
    new RegExp('(?:取|作)(?:' + side + ')?' + p + p + '的?中点(?:为|记为)?(?:点)?' + p + relationEnd, 'g')
  ];
  const normal = '(?:⊥|垂直于?)';
  const perpendicular = [
    new RegExp(relationStart + '(?:直线|线段)?' + p + p + normal + '(?:直线)?' + l + relationEnd, 'g'),
    new RegExp(relationStart + '(?:直线)?' + l + normal + '(?:直线|线段)?' + p + p + relationEnd, 'g')
  ];
  const curve = '(主曲线|圆锥曲线|椭圆|双曲线|抛物线|圆|曲线)' + p + '?';
  const touch = '(?:点)?' + p + '(?:点)?(?:处)?';
  const tangentLine = '(?:直线|切线)' + capture(named);
  const tangents = [
    new RegExp(tangentLine + ',?在' + touch + '与' + curve + '相切' + relationEnd, 'g'),
    new RegExp(tangentLine + ',?与' + curve + '相?切于' + touch + relationEnd, 'g'),
    new RegExp(tangentLine + ',?与' + curve + '在' + touch + '相切' + relationEnd, 'g'),
    new RegExp('在' + touch + '(?:作|画)' + tangentLine + ',?与' + curve + '相切' + relationEnd, 'g'),
    new RegExp(curve + '在' + touch + '的?切线(?:记为|为|是)?' + capture(named) + relationEnd, 'g')
  ];
  const curveTypes = {椭圆:'ellipse',双曲线:'hyperbola',抛物线:'parabola',圆:'circle'};

  function normalize(text) {
    const symbols = text.normalize('NFKC')
      .replace(/\\angle\b/g, '∠').replace(/\\in\b/g, '∈').replace(/\\perp\b/g, '⊥')
      .replace(/\^\s*\{\s*\\prime\s*\}|\^\s*\\prime\b|\^′|\\prime\b|['’]/g, '′')
      .replace(/⟂/g, '⊥')
      .replace(/\\(?:lvert|rvert|vert)\b/g, '|')
      .replace(/_(?:\{(\d+)\}|(\d+))/g, (_, braced, bare) => braced || bare)
      .replace(new RegExp('\\\\overline\\{\\s*('+point+')\\s*('+point+')\\s*\\}','g'), '线段$1$2');
    return (root.DongMathInput?.toPlain(symbols) ?? symbols).replace(/[$]/g, '');
  }

  function midpointRelations(clause) {
    if (/求证|请证|证明|判断|能否|是否|不(?:作|是|存在)|勿/.test(clause)) return [];
    const specs = [];
    const midpoint = (name, ends, vertex) => {
      if (new Set([name, ...ends]).size === 3)
        specs.push({op:'midpoint', point:name, ends, vertices:vertex ? [vertex] : []});
    };
    for (const [i, pattern] of midpointDefinitions.entries()) {
      for (const [, a, b, c] of clause.matchAll(pattern)) {
        if (i === 0) midpoint(a, [b, c]); else midpoint(c, [a, b]);
      }
    }
    for (const [i, pattern] of medians.entries()) {
      for (const match of clause.matchAll(pattern)) {
        const vertices = i === 0 ? match.slice(3) : match.slice(1, 4);
        const ends = i === 0 ? match.slice(1, 3) : match.slice(4, 6);
        const attached = ends.filter(name => vertices.includes(name));
        if (new Set(vertices).size !== 3 || attached.length !== 1) continue;
        const vertex = attached[0];
        const opposite = vertices.filter(name => name !== vertex);
        if (i === 4 && canonicalLine(opposite.join('')) !== canonicalLine(match[6] + match[7])) continue;
        midpoint(ends.find(name => name !== vertex), opposite, vertex);
      }
    }
    for (const [i, pattern] of sideMembership.entries()) {
      for (const match of clause.matchAll(pattern)) {
        const [name, first, last] = i === 3 ? [match[3], match[1], match[2]] : match.slice(1);
        const expected = [canonicalLine(first + name), canonicalLine(name + last)].sort();
        for (const equality of equalSegments) {
          for (const [, a, b, c, d] of clause.matchAll(equality)) {
            const actual = [canonicalLine(a + b), canonicalLine(c + d)].sort();
            if (actual[0] === expected[0] && actual[1] === expected[1]) midpoint(name, [first, last]);
          }
        }
      }
    }
    return specs;
  }

  function angleBisectors(clause) {
    const specs = [];
    for (const [i, pattern] of sideMembership.entries()) {
      for (const match of clause.matchAll(pattern)) {
        const [onSide, first, last] = i === 3 ? [match[3], match[1], match[2]] : match.slice(1);
        for (const equality of equalAngles) {
          for (const [, a, vertex, b, c, otherVertex, d] of clause.matchAll(equality)) {
            if (vertex !== otherVertex || new Set([vertex, onSide, first, last]).size !== 4) continue;
            const outerLeft = a === onSide ? b : b === onSide ? a : null;
            const outerRight = c === onSide ? d : d === onSide ? c : null;
            if (outerLeft === first && outerRight === last || outerLeft === last && outerRight === first) {
              specs.push({op:'angle_bisector', points:[first, vertex, last], point:onSide});
            }
          }
        }
      }
    }
    return specs;
  }

  function canonicalLine(name) {
    const ends = name.match(new RegExp(point, 'g'));
    return ends?.length === 2 ? ends.sort().join('') : name;
  }

  function perpendicularFeet(clause) {
    const specs = [];
    for (const [i, pattern] of lineMembership.entries()) {
      for (const match of clause.matchAll(pattern)) {
        const [onLine, target] = i === 3 ? [match[2], match[1]] : match.slice(1);
        for (const [j, relation] of perpendicular.entries()) {
          for (const constraint of clause.matchAll(relation)) {
            const [a, b, normalTo] = j === 1 ? [constraint[2], constraint[3], constraint[1]] : constraint.slice(1);
            const from = a === onLine ? b : b === onLine ? a : null;
            if (from && from !== onLine && canonicalLine(normalTo) === canonicalLine(target)) {
              specs.push({op:'foot', point:onLine, from, line:target});
            }
          }
        }
      }
    }
    return specs;
  }

  function tangentContacts(clause) {
    const specs = [];
    for (const [i, pattern] of tangents.entries()) {
      for (const [, a, b, c, d] of clause.matchAll(pattern)) {
        const [name, at, curveName, conic] =
          i === 0 ? [a, b, c, d] : i === 3 ? [b, a, c, d] : i === 4 ? [d, c, a, b] : [a, d, b, c];
        if (curveName === '主曲线' ? conic : !conic) continue;
        specs.push({op:'tangent', point:at, line:name, conic:conic || null, curveType:curveTypes[curveName] || null});
      }
    }
    return specs;
  }

  function collect(texts) {
    const results = new Map();
    const conflicts = new Set();
    for (const text of texts) {
      if (typeof text !== 'string' || text.length > 12000) continue;
      for (const line of normalize(text).split(/[。；;!\n]/).slice(0,120)) {
        const clause = line.replace(/[ \t\r]/g, '');
        if (clause.length > 1200 || negative.test(clause)) continue;
        for (const spec of [...midpointRelations(clause), ...angleBisectors(clause), ...perpendicularFeet(clause), ...tangentContacts(clause)]) {
          const key = spec.op === 'tangent' ? 'line:' + spec.line : 'point:' + spec.point;
          const signature = spec.op === 'angle_bisector'
            ? JSON.stringify([spec.op, spec.points[1], [spec.points[0], spec.points[2]].sort()])
            : spec.op === 'foot' ? JSON.stringify([spec.op, spec.from, canonicalLine(spec.line)])
            : spec.op === 'midpoint' ? JSON.stringify([spec.op, [...spec.ends].sort()]) : JSON.stringify(spec);
          const previous = results.get(key);
          if (previous && previous.signature !== signature) conflicts.add(key);
          if (!previous) results.set(key, {spec, signature});
          else if (previous.signature === signature && spec.op === 'midpoint')
            previous.spec.vertices = [...new Set([...previous.spec.vertices, ...spec.vertices])];
        }
      }
    }
    return {
      specs:[...results].filter(([key]) => !conflicts.has(key)).map(([, item]) => item.spec),
      conflicts:[...conflicts].map(key=>({kind:key.split(':')[0],label:key.split(':')[1]}))
    };
  }

  root.DongAnswerRelations = Object.freeze({parse:text=>collect([text]).specs,collect});
})(typeof window === 'object' ? window : globalThis);
