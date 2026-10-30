FROM golang:1.22-bookworm AS build

WORKDIR /src

COPY apps/settlement/go.mod apps/settlement/go.sum ./
RUN go mod download

COPY apps/settlement/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/settlement ./cmd/settlement

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/settlement /settlement
EXPOSE 8091
ENTRYPOINT ["/settlement"]
CMD ["daemon"]
