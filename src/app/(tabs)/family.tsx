import React, { useEffect, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';

import { Button, Card, Field, Heading } from '../../components/ui';
import { createFamily, joinFamily, memberCount } from '../../lib/api';
import { errorMessage, notify } from '../../lib/notify';
import { useApp } from '../../lib/session';
import { colors, space } from '../../lib/theme';

export default function FamilyScreen() {
  const { family, refreshFamily, signOut, session } = useApp();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<number | null>(null);

  useEffect(() => {
    if (family) memberCount(family.id).then(setMembers).catch(() => undefined);
  }, [family]);

  async function create() {
    if (!name.trim()) return notify('Name your family', 'For example: The Adeyemi Family');
    setBusy(true);
    try {
      await createFamily(name.trim());
      await refreshFamily();
    } catch (e) {
      notify('Could not create family', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!code.trim()) return notify('Enter the invite code', 'Ask a family member for their code.');
    setBusy(true);
    try {
      await joinFamily(code);
      await refreshFamily();
    } catch (e) {
      notify('Could not join', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      {family ? (
        <>
          <Heading sub="Everyone in this circle can listen to, fix and add stories.">{family.name}</Heading>
          <Card>
            <Text style={{ color: colors.muted, fontWeight: '600' }}>Invite code</Text>
            <Text style={{ fontSize: 32, fontWeight: '900', letterSpacing: 4, color: colors.primary, marginVertical: 8 }}>
              {family.invite_code}
            </Text>
            <Text style={{ color: colors.muted, marginBottom: space.md }}>
              {members ?? '…'} member{members === 1 ? '' : 's'}. Send this code to relatives, for example on WhatsApp, so they can join.
            </Text>
            <Button
              title="Share invite"
              onPress={() =>
                Share.share({ message: `Join our family stories on MyRoots. Invite code: ${family.invite_code}` }).catch(() => undefined)
              }
            />
          </Card>
        </>
      ) : (
        <>
          <Heading sub="A family circle keeps your recordings and book together.">Family circle</Heading>
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 17, color: colors.ink, marginBottom: space.sm }}>Create a new circle</Text>
            <Field label="Family name" value={name} onChangeText={setName} placeholder="The Adeyemi Family" />
            <Button title="Create" onPress={create} loading={busy} />
          </Card>
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 17, color: colors.ink, marginBottom: space.sm }}>Join with a code</Text>
            <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="ABC123" />
            <Button title="Join" variant="secondary" onPress={join} loading={busy} />
          </Card>
        </>
      )}

      <View style={{ marginTop: space.lg }}>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>Signed in as {session?.user.email}</Text>
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </ScrollView>
  );
}
