package main

import "github.com/dhruvyad/wago/cli/cmd"

// Set via ldflags: -ldflags="-X main.version=0.2.0"
var version = "dev"

func main() {
	cmd.SetVersion(version)
	cmd.Execute()
}
