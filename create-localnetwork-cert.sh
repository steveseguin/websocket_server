openssl req -x509 -out localhost.crt -keyout localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -addext basicConstraints=CA:TRUE,pathlen:0 \
  -subj '/CN=vdo.local' -extensions EXT -config <( \
   printf "[dn]\nCN=vdo.local\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:vdo.local\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")