package wire

import (
	"encoding/base64"
	"fmt"
	"strconv"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// Unmarshal decodes a JSON request body into m using the proto3 JSON mapping
// (camelCase or proto field names; 64-bit integers as numbers or strings;
// bytes as base64). Unknown fields are rejected.
func Unmarshal(b []byte, m proto.Message) error {
	return protojson.Unmarshal(b, m)
}

// SetField sets the scalar field called name (json_name or proto name) from
// string values such as URL query or path parameters. Repeated fields take
// every value; singular fields take exactly one.
func SetField(m proto.Message, name string, values []string) error {
	msg := m.ProtoReflect()
	fields := msg.Descriptor().Fields()
	fd := fields.ByJSONName(name)
	if fd == nil {
		fd = fields.ByName(protoreflect.Name(name))
	}
	if fd == nil {
		return fmt.Errorf("unknown parameter %q", name)
	}
	if fd.IsMap() || fd.Kind() == protoreflect.MessageKind || fd.Kind() == protoreflect.GroupKind {
		return fmt.Errorf("parameter %q cannot be set from a string", name)
	}

	if fd.IsList() {
		list := msg.Mutable(fd).List()
		for _, s := range values {
			v, err := parse(fd, s)
			if err != nil {
				return fmt.Errorf("parameter %q: %w", name, err)
			}
			list.Append(v)
		}
		return nil
	}

	if len(values) != 1 {
		return fmt.Errorf("parameter %q given %d times", name, len(values))
	}
	v, err := parse(fd, values[0])
	if err != nil {
		return fmt.Errorf("parameter %q: %w", name, err)
	}
	msg.Set(fd, v)
	return nil
}

func parse(fd protoreflect.FieldDescriptor, s string) (protoreflect.Value, error) {
	switch fd.Kind() {
	case protoreflect.StringKind:
		return protoreflect.ValueOfString(s), nil
	case protoreflect.BoolKind:
		b, err := strconv.ParseBool(s)
		return protoreflect.ValueOfBool(b), err
	case protoreflect.Int32Kind, protoreflect.Sint32Kind, protoreflect.Sfixed32Kind:
		n, err := strconv.ParseInt(s, 10, 32)
		return protoreflect.ValueOfInt32(int32(n)), err
	case protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Sfixed64Kind:
		n, err := strconv.ParseInt(s, 10, 64)
		return protoreflect.ValueOfInt64(n), err
	case protoreflect.Uint32Kind, protoreflect.Fixed32Kind:
		n, err := strconv.ParseUint(s, 10, 32)
		return protoreflect.ValueOfUint32(uint32(n)), err
	case protoreflect.Uint64Kind, protoreflect.Fixed64Kind:
		n, err := strconv.ParseUint(s, 10, 64)
		return protoreflect.ValueOfUint64(n), err
	case protoreflect.FloatKind:
		f, err := strconv.ParseFloat(s, 32)
		return protoreflect.ValueOfFloat32(float32(f)), err
	case protoreflect.DoubleKind:
		f, err := strconv.ParseFloat(s, 64)
		return protoreflect.ValueOfFloat64(f), err
	case protoreflect.BytesKind:
		b, err := base64.StdEncoding.DecodeString(s)
		return protoreflect.ValueOfBytes(b), err
	case protoreflect.EnumKind:
		if ev := fd.Enum().Values().ByName(protoreflect.Name(s)); ev != nil {
			return protoreflect.ValueOfEnum(ev.Number()), nil
		}
		n, err := strconv.ParseInt(s, 10, 32)
		return protoreflect.ValueOfEnum(protoreflect.EnumNumber(n)), err
	}
	return protoreflect.Value{}, fmt.Errorf("unsupported kind %s", fd.Kind())
}
