d3.sankey = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [],
      bezierLink = false,
      sinksRight = true;

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.bezierLink = function(_) {
    if (!arguments.length) return bezierLink;
    bezierLink = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

 sankey.sinksRight = function (_) {
    if (!arguments.length) return sinksRight;
    sinksRight = _;
    return sankey;
 };

  sankey.layout = function(iterations) {

    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    return sankey;
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };

  // SVG path data generator, to be used as "d" attribute on "path" element selection.
  sankey.link = function() {
    var curvature = .5;

    function link(d) {
      var xs = d.source.x + nodeWidth,
          xt = d.target.x,
          xi = d3.interpolateNumber(xs, xt),
          xsc = xi(curvature),
          xtc = xi(1 - curvature),
          ys = d.source.y + d.sy + d.dy / 2,
          yt = d.target.y + d.ty + d.dy / 2;

      if (!d.cycleBreaker) {
        if (bezierLink) {
          // BEZIER CURVE: does not always work
          return "M" + xs + "," + ys
               + "C" + xsc + "," + ys
               + " " + xtc + "," + yt
               + " " + xt + "," + yt;
        } else {
          // TRAPEZOID connection
          return "M" + (xs) + "," + (ys - d.dy/2)
               + "L" + (xs) + "," + (ys + d.dy/2)
               + " " + (xt) + "," + (yt + d.dy/2)
               + " " + (xt) + "," + (yt - d.dy/2) + " z";
        }

      } else {
        var xdelta = (1.5 * d.dy + 0.05 * Math.abs(xs - xt));
        xsc = xs + xdelta;
        xtc = xt - xdelta;
        var xm = xi(0.5);
        var ym = d3.interpolateNumber(ys, yt)(0.5);
        var ydelta = (2 * d.dy + 0.1 * Math.abs(xs - xt) + 0.1 * Math.abs(ys - yt)) * (ym < (size[1] / 2) ? -1 : 1);
        return "M" + xs + "," + ys
             + "C" + xsc + "," + ys
             + " " + xsc + "," + (ys + ydelta)
             + " " + xm + "," + (ym + ydelta)
             + "S" + xtc + "," + yt
             + " " + xt + "," + yt;

      }
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      // Links that have this node as source.
      node.sourceLinks = [];
      // Links that have this node as target.
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    if (typeof nodes[0].value == "undefined") {
      nodes.forEach(function(node) {
        node.value = Math.max(
          d3.sum(node.sourceLinks, value),
          d3.sum(node.targetLinks, value)
        );
      });
    }
  }

  var max_depth = 0
  var summed_str_length = [0];

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
 

    if (typeof nodes[0].depth == "undefined") {
      var remainingNodes = nodes,
          x = 0,
          nextNodes;
      // Work from left to right.
      // Keep updating the breath (x-position) of nodes that are target of recently updated nodes.
      while (remainingNodes.length && x < nodes.length) {
        nextNodes = [];
        remainingNodes.forEach(function(node) {
          node.x = x;
          node.depth = x;
  
          node.sourceLinks.forEach(function(link) {
            if (nextNodes.indexOf(link.target) < 0 && !link.cycleBreaker) {
              nextNodes.push(link.target);
            }
          });
        });
        if (nextNodes.length == remainingNodes.length) {
          // There must be a cycle here. Let's search for a link that breaks it.
          findAndMarkCycleBreaker(nextNodes);
          // Start over.
          // TODO: make this optional?
          return computeNodeBreadths();
        }
        else {
          remainingNodes = nextNodes;
          ++x;
        }
      }
    } else {
        nodes.forEach(function(node) {
            node.x = node.depth;
        });
    }
    
    // calculate maximum string lengths at each depth
    max_depth = d3.max(nodes, function(d) { return(d.x); } ) + 1;
    var max_str_length = new Array(max_depth);
    nodes.forEach(function(node) {
        if (typeof max_str_length[node.x] == "undefined" || node.name.length > max_str_length[node.x]) {
            max_str_length[node.x] = node.name.length;
        }

        // make a path to the beginning for vertical ordering
        node.path = node.name;
        nn = node
        while (nn.targetLinks.length) {
            nn = nn.targetLinks[0].source
            //for (depth = nn.depth - 1; nn_source.depth > depth; --depth) {
            //    node.path = nn.name + ";" + node.path;
            //}
            //nn = nn_source
            node.path = nn.name + ";" + node.path;
        }

    });

    for (i=1; i<max_depth; ++i) {
        summed_str_length[i] = summed_str_length[i-1] + max_str_length[i-1] * 6 + nodeWidth + nodePadding;
    }

    // Optionally move pure sinks always to the right, and scale node breadths
    if (sinksRight) {
      moveSinksRight(max_depth);
      scaleNodeBreadths((size[0] - nodeWidth) / (max_depth - 1));
    } else {
      scaleNodeBreadths((size[0] - nodeWidth) / max_depth);
    }

    
  }

  // Find a link that breaks a cycle in the graph (if any).
  function findAndMarkCycleBreaker(nodes) {
  // Go through all nodes from the given subset and traverse links searching for cycles.
    var link;
    for (var n=nodes.length - 1; n >= 0; n--) {
      link = depthFirstCycleSearch(nodes[n], []);
      if (link) {
        return link;
      }
    }

    // Depth-first search to find a link that is part of a cycle.
    function depthFirstCycleSearch(cursorNode, path) {
      var target, link;
      for (var n = cursorNode.sourceLinks.length - 1; n >= 0; n--) {
        link = cursorNode.sourceLinks[n];
        if (link.cycleBreaker) {
          // Skip already known cycle breakers.
          continue;
        }

        // Check if target of link makes a cycle in current path.
        target = link.target;
        for (var l = 0; l < path.length; l++) {
          if (path[l].source == target) {
            // We found a cycle. Search for weakest link in cycle
            var weakest = link;
            for (; l < path.length; l++) {
              if (path[l].value < weakest.value) {
                weakest = path[l];
              }
            }
            // Mark weakest link as (known) cycle breaker and abort search.
            weakest.cycleBreaker = true;
            return weakest;
          }
        }

        // Recurse deeper.
        path.push(link);
        link = depthFirstCycleSearch(target, path);
        path.pop();
        // Stop further search if we found a cycle breaker.
        if (link) {
          return link;
        }
      }
    }
  }


  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      } else {
        //move node to second from right 
        var nodes_to_right = 0;
        node.sourceLinks.forEach(function(n) {
          nodes_to_right = Math.max(nodes_to_right,n.target.sourceLinks.length)
        })
         if (nodes_to_right==0)node.x = x - 2;
      }
      
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      //node.x *= Math.max(minLinkWidth,Math.min(kx, maxLinkWidth));
      node.x = summed_str_length[node.x];
    });
  }

  // Compute the depth (y-position) for each node.
  function computeNodeDepths(iterations) {

    var more_nodes = nodes;
    var nodesByBreadth = new Array(max_depth);
    for (i=0; i < nodesByBreadth.length; ++i) {
        nodesByBreadth[i] = [];
    }
    // Add 'invisible' nodes to account for different depths
    for (depth=0; depth < max_depth; ++depth) {
        for (j=0; j < nodes.length; ++j) {
            if (nodes[j].depth != depth) {
                continue;
            }
            node = nodes[j];
            nodesByBreadth[depth].push(node);
            if (node.sourceLinks.length && node.sourceLinks[0].target.depth > node.depth +1) {
                for (new_node_depth=node.depth+1; new_node_depth < node.sourceLinks[0].target.depth; ++new_node_depth) {
                    var new_node = node.constructor();
                    new_node.depth = new_node_depth;
                    new_node.dy = node.dy;
                    new_node.y = node.y;
                    new_node.value = node.value;
                    new_node.path = node.path;
                    new_node.sourceLinks = node.sourceLinks;
                    new_node.targetLinks = node.targetLinks;
                    nodesByBreadth[new_node_depth].push(new_node);
                }
            }
        }
    }

    // Group nodes by breath.
    //var nodesByBreadth = d3.nest()
    //    .key(function(d) { return d.x; })
    //    .sortKeys(d3.ascending)
    //    .entries(nodes)
    //    .map(function(d) { return d.values; });

    initializeNodeDepth();
    resolveCollisions();
    computeLinkDepths();
    for (var alpha = 1; iterations > 0; --iterations) {
      relaxRightToLeft(alpha *= .99);
      resolveCollisions();
      computeLinkDepths();
      relaxLeftToRight(alpha);
      resolveCollisions();
      computeLinkDepths();
    }

    function initializeNodeDepth() {
      // Calculate vertical scaling factor.
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            // Value-weighted average of the y-position of source node centers linked to this node.
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return (link.source.y + link.sy + link.dy / 2) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            // Value-weighted average of the y-positions of target nodes linked to this node.
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return (link.target.y + link.ty + link.dy / 2) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return ( a.path < b.path ? -1 : (a.path > b.path ? 1 : 0 ));
    }
  }

  // Compute y-offset of the source endpoint (sy) and target endpoints (ty) of links,
  // relative to the source/target node's y-position.
  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  // Y-position of the middle of a node.
  function center(node) {
    return node.y + node.dy / 2;
  }

  // Value property accessor.
  function value(x) {
    return x.value;
  }

  return sankey;
};
