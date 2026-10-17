// Package web serves the PWA. The production build in web/dist is embedded
// into the binary; a directory on disk can be served instead.
package web

import (
	"embed"
	"errors"
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"strings"
)

//go:embed all:dist
var dist embed.FS

func init() {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

// Files returns the embedded build, or dir when non-empty.
func Files(dir string) (fs.FS, error) {
	if dir == "" {
		return fs.Sub(dist, "dist")
	}
	if st, err := os.Stat(dir); err != nil {
		return nil, err
	} else if !st.IsDir() {
		return nil, errors.New(dir + " is not a directory")
	}
	return os.DirFS(dir), nil
}

// noCache lists files that must be revalidated on every load so PWA
// updates are picked up.
var noCache = map[string]bool{
	"index.html":           true,
	"sw.js":                true,
	"service-worker.js":    true,
	"manifest.webmanifest": true,
	"manifest.json":        true,
}

// Handler serves files from fsys. Extension-less paths that don't exist fall
// back to index.html so client-side routes work on reload.
func Handler(fsys fs.FS) http.Handler {
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if st, err := fs.Stat(fsys, name); err != nil || st.IsDir() {
			if path.Ext(name) != "" {
				http.NotFound(w, r)
				return
			}
			name = "index.html"
		}
		if noCache[path.Base(name)] {
			w.Header().Set("Cache-Control", "no-cache")
		}
		if name == "index.html" {
			// FileServer redirects /index.html to /; serve it directly.
			http.ServeFileFS(w, r, fsys, name)
			return
		}
		files.ServeHTTP(w, r)
	})
}
