/**
 * Copyright 2023 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
const commonConfig = require("./webpack.config");

module.exports = {
  ...commonConfig,
  mode: "production",
  optimization: {
    chunkIds: "named",
  },
};
